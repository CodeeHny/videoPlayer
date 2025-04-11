import { Router } from "express";
import { changePassword, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
import { upload } from '../middlewares/multer.middleware.js'
import { varifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route('/register').post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route('/login').post(
    loginUser
)

// Secured Route 
router.route('/logout').post(varifyJWT, logoutUser);
router.route('/refresh-token').post(refreshAccessToken);
router.route('/change-password').post(varifyJWT, changePassword);
router.route('/c/:username').get(varifyJWT, getUserChannelProfile);
router.route('/history').get(varifyJWT, getWatchHistory)

export default router;