
// users.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../common/ApiResponse.js';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { UpdateUserInput } from './user.schema.js';
import {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  getAllUsersList,
  deleteAllUsersData,
} from './user.service.js';
import { ApiError } from '../../common/ApiError.js';
import logger from  '../../config/logger.js';

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    
    if (!req.userId) {
      logger.info({ userId: req.userId }, "ID not found");
      throw new ApiError(401, "Authentication required.");
    }
    const user = await getUserProfile(req.userId);
    res.status(200).json(new ApiResponse('Profile fetched.', user));
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (
  req: AuthenticatedRequest & Request<unknown, unknown, UpdateUserInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) throw new ApiError(401, 'Authentication required.');
    const user = await updateUserProfile(req.userId, req.body);
    res.status(200).json(new ApiResponse('Profile updated.', user));
  } catch (err) {
    next(err);
  }
};

export const deleteMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) throw new ApiError(401, 'Authentication required.');
    await deleteUserAccount(req.userId);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('trusted_device_id');
    res.status(200).json(new ApiResponse('Account deleted.', null));
  } catch (err) {
    next(err);
  }
};

export const getAllUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await getAllUsersList();
    res.status(200).json(new ApiResponse('All users fetched.', users));
  } catch (err) {
    next(err);
  }
};

export const deleteAllUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteAllUsersData();
    res.status(200).json(new ApiResponse('All users deleted.', null));
  } catch (err) {
    next(err);
  }
};
