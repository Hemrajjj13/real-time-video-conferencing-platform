import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";


const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Username and password are required." });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res
                .status(httpStatus.NOT_FOUND)
                .json({ message: "User not found." });
        }

        let isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (isPasswordCorrect) {
            let token = crypto.randomBytes(20).toString("hex");

            user.token = token;
            await user.save();

            return res.status(httpStatus.OK).json({
                token,
                user: {
                    name: user.name,
                    username: user.username,
                },
            });
        }

        return res
            .status(httpStatus.UNAUTHORIZED)
            .json({ message: "Invalid username or password." });

    } catch (error) {
        return res
            .status(500)
            .json({ message: `Something went wrong: ${error.message}` });
    }
};


const register = async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Name, username and password are required." });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res
                .status(httpStatus.CONFLICT)
                .json({ message: "User already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res
            .status(httpStatus.CREATED)
            .json({ message: "User registered successfully." });
        
        
    } catch (error) {
        return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: `Something went wrong: ${error.message}` });
    }
};

const getUserHistory = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Token is required." });
    }

    try {
        const user = await User.findOne({ token: token });
        if (!user) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Invalid token." });
        }

        const meetings = await Meeting.find({ user_id: user.username });

        return res.json(
            meetings.map((meeting) => ({
                _id: meeting._id,
                user_id: meeting.user_id,
                meetingCode: meeting.meetingCode || meeting.mettingCode,
                date: meeting.date,
            })),
        );
    } catch (error) {
        return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: `Something went wrong: ${error.message}` });
    }
};

const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    if (!token || !meeting_code) {
        return res
            .status(httpStatus.BAD_REQUEST)
            .json({ message: "Token and meeting code are required." });
    }

    try {
        const user = await User.findOne({ token: token });
        if (!user) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Invalid token." });
        }

        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code,
        });

        await newMeeting.save();

        res
            .status(httpStatus.CREATED)
            .json({ message: "Added code to history." });
    } catch (error) {
        return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: `Something went wrong: ${error.message}` });
    }
};

export { login, register, getUserHistory, addToHistory };
