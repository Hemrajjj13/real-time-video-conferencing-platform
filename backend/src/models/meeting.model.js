import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
        user_id: { type: String },
        meetingCode: { type: String },
        mettingCode: { type: String },
        date: { type: Date, default: Date.now, required: true }
    },
    {
        versionKey: false,
    },
);

meetingSchema.pre("save", function syncMeetingCode(next) {
    if (!this.meetingCode && this.mettingCode) {
        this.meetingCode = this.mettingCode;
    }

    if (!this.mettingCode && this.meetingCode) {
        this.mettingCode = this.meetingCode;
    }

    next();
});

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };
