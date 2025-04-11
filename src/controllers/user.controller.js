import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';


let options = {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
};

const generateAccessAndrefreshToken = async (userId) => {
    try {

        let user = await User.findById(userId);
        let accessToken = user.generateAccessToken();
        let refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "somthing went wrong while generating access and refresh token ", error)
    }
}

const registerUser = asyncHandler(async (req, res) => {

    let { username, email, password, fullname } = req.body;

    if (
        [username, email, password, fullname].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "Every field is required");
    };

    let existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(408, "username and email already exist ");
    }

    let avatarLocalPath = req.files?.avatar?.[0]?.path;
    let coverImageLocalPath = req.files?.coverImage?.[0]?.path;


    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar is required ");
    }

    let avatar = await uploadOnCloudinary(avatarLocalPath);

    let coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar is required ");
    }

    let user = await User.create({
        username: username.toLowerCase(),
        email,
        password,
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
    })

    let createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        ApiError(500, "Somthing went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));

})

const loginUser = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    if ([email, password].some((filed) => filed?.trim() === ' ')) {
        throw new ApiError(400, "Every filed is required");
    };
    let user = await User.findOne({ email });

    if (!user) throw new ApiError(404, "User not found");

    let isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) throw new ApiError(401, "Password was incorrect");

    const { accessToken, refreshToken } = await generateAccessAndrefreshToken(user._id);

    let loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully"
            )
        )
});

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    );

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(201, {}, "User logout successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {

    let incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

    let decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    let user = await User.findById(decodedToken?._id);

    if (!user) throw new ApiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Refresh token was invalid or expired");

    let { refreshToken, accessToken } = await generateAccessAndrefreshToken(user._id);

    return res
        .status(200)
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(new ApiResponse(
            200,
            { refreshToken, accessToken },
            "Access token refreshed successfuly"
        ))

})

const changePassword = asyncHandler(async (req, res) => {
    let { oldPassword, newPassword } = req.body;

    let user = await User.findById(req.user?._id);

    let isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) throw new ApiError(400, "Password was incorrect");

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed succesfully"));
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    let { username } = req.params;

    if (!username) throw new ApiError(400, "Username is missing");

    let channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberToCount: {
                    $size: "$subscribers"
                },
                channelsSubscriberToCount: {
                    $size: "subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                },
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscriberToCount: 1,
                channelsSubscriberToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel doesn't exist");
    };

    return res
        .status(200)
        .json(new ApiError(
            200,
            { channel: channel[0] },
            "User channel fetched successfully"
        ))
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getUserChannelProfile,
    getWatchHistory,
};