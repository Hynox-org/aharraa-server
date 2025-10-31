/**
 * @fileoverview Auth routes for signup, signin, and token verification
 */
const express = require("express");
const Joi = require("joi");
const User = require("../models/User");
const supabase = require("../config/supabase"); // Import Supabase client

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Email already exists or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/signup", async (req, res) => {
  try {
    const { error: validationError } = registerSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError.details[0].message });
    }

    const { email, password } = req.body;

    // Check if user already exists in MongoDB (optional, Supabase will also handle unique emails)
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Register user with Supabase Auth
    const { data, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (supabaseError) {
      console.error("Supabase registration error:", supabaseError);
      return res.status(400).json({ message: supabaseError.message });
    }

    if (!data || !data.user) {
      return res.status(500).json({ message: "Supabase registration failed: No user data returned." });
    }

    // Save user data to MongoDB
    user = new User({ name : email, email, supabaseId: data.user.id });
    await user.save();

    // Return Supabase access token
    res.status(201).json({
      message: "User registered successfully",
      accessToken: data.session.access_token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user and provide an access token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/signin", async (req, res) => {
  try {
    const { error: validationError } = loginSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError.details[0].message });
    }

    const { email, password } = req.body;

    // Authenticate user with Supabase Auth
    const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supabaseError) {
      console.error("Supabase login error:", supabaseError);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!data || !data.user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Find user in MongoDB using supabaseId
    const user = await User.findOne({ supabaseId: data.user.id });
    if (!user) {
      // This case should ideally not happen if registration flow is correct
      return res.status(401).json({ message: "User not found in database" });
    }

    // Return Supabase access token
    res.status(200).json({
      message: "Login successful",
      accessToken: data.session.access_token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/auth/validate-token:
 *   get:
 *     summary: Validate the user's access token and return basic user details.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.post("/verify", async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token with Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.getUser(token);

    if (supabaseError || !supabaseUser || !supabaseUser.user) {
      console.error("Supabase token validation error:", supabaseError);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Find user in MongoDB using supabaseId
    const user = await User.findOne({ supabaseId: supabaseUser.user.id });
    if (!user) {
      return res.status(401).json({ message: "User not found in database" });
    }

    res.status(200).json({
      message: "Token is valid",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @openapi
 * /api/auth/oauth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to Google for authentication
 */
router.get("/oauth/google", async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: process.env.SUPABASE_OAUTH_REDIRECT_URL || 'http://localhost:3000/auth/callback', // Ensure this matches your Supabase redirect URL
    },
  });

  if (error) {
    console.error("Supabase OAuth initiation error:", error);
    return res.status(500).json({ message: "Failed to initiate OAuth login" });
  }

  return res.status(200).json({
    url : data.url
});
});

/**
 * @openapi
 * /api/auth/callback:
 *   get:
 *     summary: OAuth callback endpoint
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Handles OAuth redirect and provides access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: OAuth callback error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("Supabase OAuth callback error:", error);
    return res.status(400).json({ message: error });
  }

  if (code) {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Supabase code exchange error:", exchangeError);
      return res.status(400).json({ message: exchangeError.message });
    }

    if (!data || !data.user) {
      return res.status(400).json({ message: "OAuth callback failed: No user data returned." });
    }

    // Check if user exists in MongoDB, if not, create them
    let user = await User.findOne({ supabaseId: data.user.id });
    if (!user) {
      user = new User({
        name: data.user.user_metadata?.full_name || data.user.email, // Use full_name or email from Supabase
        email: data.user.email,
        supabaseId: data.user.id,
      });
      await user.save();
    }

    const accessToken = generateToken(user._id);

    // Redirect to a frontend page with the access token or return JSON
    // Return Supabase access token
    return res.status(200).json({
      message: "OAuth login successful",
      accessToken: data.session.access_token,
    });
  }

  return res.status(400).json({ message: "OAuth callback failed: No code provided." });
});

module.exports = router;
