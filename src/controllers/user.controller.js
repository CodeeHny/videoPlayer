import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js';
import uploadOnCloudinary from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/apiResponse.js';

const registerUser = asyncHandler(async (req, res, next) => {

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

    let avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath = req.files?.coverImage?.[0]?.path ;

    console.log("hi", req.files);

    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar is required ");
    }

    let avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log(avatar)

    let coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "avatar is required ");
    }

    console.log(avatar)

    let user = await User.create({
        username : username.toLowerCase(),
        email, 
        password,
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || '',
    }) 

    let createdUser = await User.findById(user._id).select("-password -refreshToken");

    console.log(createdUser)

    if (!createdUser) {
        ApiError(500, "Somthing went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));

})

export {
    registerUser
};