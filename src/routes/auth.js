/**
 * @fileoverview Auth routes for signup, signin, OAuth, and token verification
 */
const express = require("express");
const Joi = require("joi");
const supabase = require("../config/supabase");
const User = require("../models/User");

const router = express.Router();

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const signinSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Create a new user using Supabase email/password
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
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Signup successful (may require email confirmation)
 */
router.post("/signup", async (req, res) => {
  try {
    const { error: validationError } = signupSchema.validate(req.body);
    if (validationError)
      return res.status(400).json({ error: validationError.message });

    const { email, password } = req.body;

    // Use Supabase auth to create the user (server-side)
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });

    // data contains user info (may be null if email confirmation is required)
    const user = data?.user || data;
    if (user && user.id) {
      // Mirror a minimal user in MongoDB
      try {
        await User.findOneAndUpdate(
          { supabaseId: user.id },
          {
            supabaseId: user.id,
            email: user.email || email,
            metadata: user.user_metadata || {},
          },
          { upsert: true, new: true }
        );
      } catch (mongoErr) {
        console.warn("Failed to mirror user in MongoDB", mongoErr);
      }
    }
    const accessToken = data?.session?.access_token || null;
    res.status(200).json({
      message: "Registered successful",
      accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /auth/signin:
 *   post:
 *     summary: Sign in with email/password
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
 *         description: Signin successful; returns Supabase session info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     session:
 *                       type: object
 *       400:
 *         description: Invalid request (validation error or invalid credentials)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post("/signin", async (req, res) => {
  try {
    const { error: validationError } = signinSchema.validate(req.body);
    if (validationError)
      return res.status(400).json({ error: validationError.message });

    const { email, password } = req.body;

    // Server-side sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return res.status(400).json({ error: error.message });

    // Optionally mirror user to Mongo
    const user = data?.user;
    if (user && user.id) {
      try {
        await User.findOneAndUpdate(
          { supabaseId: user.id },
          {
            supabaseId: user.id,
            email: user.email || email,
            metadata: user.user_metadata || {},
          },
          { upsert: true, new: true }
        );
      } catch (mongoErr) {
        console.warn("Failed to mirror user in MongoDB", mongoErr);
      }
    }

    // Optionally set session cookie with access token if available
    const accessToken = data?.session?.access_token || null;
    res.status(201).json({
      message: "Login successful",
      accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /auth/oauth/google:
 *   get:
 *     summary: Get a Supabase OAuth redirect URL for Google
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: redirect
 *         schema:
 *           type: string
 *         description: Optional redirect URL after OAuth
 *     responses:
 *       200:
 *         description: Returns a URL to redirect the user to start Google OAuth
 */
router.get("/oauth/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const redirectTo =
      process.env.SUPABASE_REDIRECT_URL || req.query.redirect || null;
    // This returns a URL to redirect the user to
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true, url: data?.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @openapi
 * /auth/verify:
 *   post:
 *     summary: Verify a Supabase access token and return user info
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [access_token]
 *             properties:
 *               access_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token valid and user info returned
 */
router.post("/verify", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "token required" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error) return res.status(401).json({ error: error.message });

    return res.status(200).json({
      message: "Token is valid",
      user: data?.user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
