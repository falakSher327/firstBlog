const bcrypt = require("bcrypt");
const User = require("../models/user");
const Joi = require("joi");
const UserDTO = require("../dto/user");
const RefreshToken = require("../models/token");
const JWTService = require("../services/JWTService");

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,25}$/;
const authController = {
  async register(req, res, next) {
    const userRegisterSchema = Joi.object({
      name: Joi.string().max(30).required(),
      username: Joi.string().min(5).max(30).required(),
      email: Joi.string().email().required(),
      password: Joi.string().pattern(passwordPattern).required(),
      confirmPassword: Joi.ref("password"),
    });

    const { error } = userRegisterSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const { name, username, password, email } = req.body;

    try {
      const emailinUse = await User.exists({ email });
      const usernameinUse = await User.findOne({ username });
      if (emailinUse) {
        const error = {
          status: 409,
          message: "Email Is Already In Use",
        };
        return next(error);
      }
      if (usernameinUse) {
        const error = {
          status: 409,
          message: "Username is Already in Use",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    let accessToken;
    let refreshToken;
    let user;
    try {
      const usertoRegister = new User({
        name,
        username,
        email,
        password: hashedPassword,
      });
      user = await usertoRegister.save();
      //token generation
      accessToken = JWTService.signAccessToken({ _id: user._id }, "30m");
      refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");
    } catch (error) {
      return next(error);
    }

    // store refresh token in db
    await JWTService.storeRefreshToken(refreshToken, user._id);
    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    const userDto = new UserDTO(user);
    return res.status(201).json({ user: userDto, auth: true });
  },
  async login(req, res, next) {
    const userLoginSchema = Joi.object({
      username: Joi.string().min(5).max(30).required(),
      password: Joi.string().pattern(passwordPattern).required(),
    });

    const { error } = userLoginSchema.validate(req.body);
    if (error) {
      return next(error);
    }
    const { username, password } = req.body;
    let user;
    let accessToken;
    let refreshToken;
    try {
      user = await User.findOne({ username });
      if (!user) {
        error = {
          status: 401,
          message: "User Not Found",
        };
        return next(error);
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        error = {
          status: 401,
          message: "Invalid Password",
        };
        return next(error);
      }
    } catch (error) {
      return next(error);
    }
    accessToken = JWTService.signAccessToken({ _id: user._id }, "30m");
    refreshToken = JWTService.signRefreshToken({ _id: user._id }, "60m");

    try {
      await RefreshToken.updateOne(
        {
          _id: user._id,
        },
        {
          token: refreshToken,
        },
        { upsert: true }
      );
    } catch (error) {
      return next(error);
    }
    res.cookie("accessToken", accessToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });
    res.cookie("refreshToken", refreshToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
    });

    const userdto = new UserDTO(user);
    return res.status(200).json({ user: userdto, auth: true });
  },
  async logout(req, res, next) {
    const { refreshToken } = req.cookies;

    try {
      await RefreshToken.deleteOne({ token: refreshToken });
    } catch (error) {
      return next(error);
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.status(200).json({ user: null, auth: false });
  },
  async refresh(req, res, next) {
    // 1. get refreshToken from cookies
    // 2. verify refreshToken
    // 3. generate new tokens
    // 4. update db, return response

    const originalRefreshToken = req.cookies.refreshToken;

    let id;

    try {
      id = JWTService.verifyRefreshToken(originalRefreshToken)._id;
    } catch (e) {
      const error = {
        status: 401,
        message: "Unauthorized",
      };

      return next(error);
    }

    try {
      const match = RefreshToken.findOne({
        _id: id,
        token: originalRefreshToken,
      });

      if (!match) {
        const error = {
          status: 401,
          message: "Unauthorized",
        };

        return next(error);
      }
    } catch (e) {
      return next(e);
    }

    try {
      const accessToken = JWTService.signAccessToken({ _id: id }, "30m");

      const refreshToken = JWTService.signRefreshToken({ _id: id }, "60m");

      await RefreshToken.updateOne({ _id: id }, { token: refreshToken });

      res.cookie("accessToken", accessToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });

      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
      });
    } catch (e) {
      return next(e);
    }

    const user = await User.findOne({ _id: id });

    const userDto = new UserDTO(user);

    return res.status(200).json({ user: userDto, auth: true });
  },
};
module.exports = authController;
