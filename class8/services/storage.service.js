import ImageKit from '@imagekit/nodejs';

async function uploadFile(buffer, fileName = `image-${Date.now()}.jpg`, folder = "products") {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error("IMAGEKIT_PRIVATE_KEY is not set. Add it to the backend .env file.");
    }

    const client = new ImageKit({ privateKey });
    const response = await client.files.upload({
        file: buffer.toString("base64"),
        fileName,
        folder
      });
      return response
}
export default uploadFile