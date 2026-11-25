import mongoose from "mongoose";

export function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export async function inTransaction(work) {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
}
