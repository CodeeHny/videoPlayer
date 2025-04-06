import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

router.get('/error', asyncHandler(async (req, res , next)=>{
    throw new Error("Something went wrong!")
}));

export default router;