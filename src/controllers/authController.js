const UserModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const asyncHandle = require("express-async-handler");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.USERNAME_EMAIL,
    pass: process.env.PASSWORD_EMAIL,
  },
});

const getJsonWebToken = async (email, id) => {
  const payload = {
    email,
    id,
  };
  const token = jwt.sign(payload, process.env.SECRET_KEY, {
    expiresIn: "7d",
  });

  return token;
};

const handleSendMail = async (val) => {
  try {
    await transporter.sendMail(val);
    return "OKE";
  } catch (error) {
    return error;
  }
};

const verification = asyncHandle(async (req, res) => {
  const { email } = req.body;
  const verificationCode = Math.round(1000 + Math.random() * 9000);

  try {
    const data = {
      from: `Support Eventhub Application👻 <xuankhanguyen.hcmute@gmail.com>`, // sender address
      to: email, // list of receivers
      subject: "Verification email code ✔", // Subject line
      text: "Your code to verification email", // plain text body
      html: `<h2>Your verification code is: ${verificationCode}</h2>`, // html body
    };
    await handleSendMail(data);
    res.status(200).json({
      message: "Send verification code successfully!!!",
      data: {
        code: verificationCode,
      },
    });
  } catch (error) {
    res.status(401);
    throw new Error("Can not send email");
  }
});

const register = asyncHandle(async (req, res) => {
  const { email, fullname, password } = req.body;

  const existingUser = await UserModel.findOne({ email });

  if (existingUser) {
    res.status(401);
    throw new Error(`Người dùng đã tồn tại!!`);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new UserModel({
    email,
    fullname: fullname ?? "",
    password: hashedPassword,
  });
  await newUser.save();

  res.status(200).json({
    message: "Đăng ký người dùng thành công",
    data: {
      email: newUser.email,
      id: newUser.id,
      accesstoken: await getJsonWebToken(email, newUser.id),
    },
  });
});

const login = asyncHandle(async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await UserModel.findOne({ email });
  if (!existingUser) {
    res.status(403).json({
      message: "User not found!!!",
    });
    throw new Error("User not found !!!");
  }
  const isMatchPassword = await bcrypt.compare(password, existingUser.password);
  if (!isMatchPassword) {
    res.status(401);
    throw new Error("Email or Password is not correct!");
  }
  res.status(200).json({
    message: "Login successfully",
    data: {
      id: existingUser.id,
      email: existingUser.email,
      accesstoken: await getJsonWebToken(email, existingUser.id),
    },
  });
});
const forgotPassword = asyncHandle(async (req, res) => {
  const { email } = req.body;

  const randomPassword = Math.round(100000 + Math.random() * 99000);

  const data = {
    from: `"New Password" <${process.env.USERNAME_EMAIL}>`,
    to: email,
    subject: "Verification email code",
    text: "Your code to verification email",
    html: `<h1>${randomPassword}</h1>`,
  };

  const user = await UserModel.findOne({ email });
  if (user) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(`${randomPassword}`, salt);

    await UserModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      isChangePassword: true,
    })
      .then(() => {
        console.log("Done");
      })
      .catch((error) => console.log(error));

    await handleSendMail(data)
      .then(() => {
        res.status(200).json({
          message: "Send email new password successfully!!!",
          data: [],
        });
      })
      .catch((error) => {
        res.status(401);
        throw new Error("Can not send email");
      });
  } else {
    res.status(401);
    throw new Error("User not found!!!");
  }
});

const handleLoginWithGoogle = asyncHandle(async (req, res) => {
  const userInfo = req.body;

  const existingUser = await UserModel.findOne({ email: userInfo.email });
  let user = { ...userInfo };
  if (existingUser) {
    await UserModel.findByIdAndUpdate(existingUser.id, {
      ...userInfo,
      updatedAt: Date.now(),
    });
    user.accesstoken = await getJsonWebToken(userInfo.email, userInfo.id);
  } else {
    const newUser = new UserModel({
      email: userInfo.email,
      fullname: userInfo.name,
      ...userInfo,
    });
    await newUser.save();
    user.accesstoken = await getJsonWebToken(userInfo.email, newUser.id);
  }
  res.status(200).json({
    message: "Login with google successfully!!",
    data: user,
  });
});

module.exports = {
  register,
  login,
  verification,
  forgotPassword,
  handleLoginWithGoogle,
};
