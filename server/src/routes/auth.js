import express from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/authorization";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const prisma = new PrismaClient();

export function getAuthRoutes() {
  const router = express.Router();

  router.post("/google-login", googleLogin);
  router.get("/me", protect, me);
  router.get("/signout", signout);

  return router;
}

// Auth Controllers/Utility Functions Here
async function googleLogin(req, res) {
  const { idToken } = req.body;
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  })
  const { email, name, picture } = ticket.getPayload()

  let user = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email, username: name, avatar: picture
      },
    });
  }

  const tokenPayload = { id: user.id };
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  console.log(token)
  // httpOnly cookies can only be created and destroyed
  // by the server
  res.cookie("token", token, { httpOnly: true });
  res.status(200).send(token);
}

async function me(req, res) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      subscriberId: {
        equals: req.user.id
      }
    }
  })

  const channelIds = subscriptions.map((sub) => sub.subscribedToId)

  const channels = await prisma.user.findMany({
    where: {
      id: {
        in: channelIds
      }
    }
  })

  const user = req.user
  user.channels = channels

  res.status(200).json({ user });
}

function signout(req, res) {
  res.clearCookie('token');
  res.status(200).json({})
}