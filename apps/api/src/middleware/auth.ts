import { auth, fromNodeHeaders } from '@workspace/auth';
import { NextFunction, Request, Response } from 'express';

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    // Ensure user object includes all required properties
    let userWithDefaults = null;
    if (session?.user) {
      userWithDefaults = {
        twoFactorEnabled: null,
        username: undefined,
        displayUsername: undefined,
        ...session.user,
      };
    }
    if (session && userWithDefaults) {
      req.session = { ...session, user: userWithDefaults };
      req.user = userWithDefaults;
    } else {
      req.session = null;
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Error getting session:', error);
    req.session = null;
    req.user = null;
    next();
  }
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (req.session === undefined) {
    await getSession(req, res, () => {});
  }

  if (!req.session || !req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  next();
};
