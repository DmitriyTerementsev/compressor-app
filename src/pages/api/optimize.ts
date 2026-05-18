import type { APIRoute } from "astro";

const TINIFY_ENDPOINT = "https://api.tinify.com/shrink";
const SUPPORTED_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type TinifyError = {
  error?: string;
  message?: string;
};

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.TINIFY_API_KEY;

  if (!apiKey) {
    return json({ error: "TINIFY_API_KEY is not configured on the server." }, 500);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "Multipart form data is required." }, 400);
  }

  const formData = await request.formData();
  const source = formData.get("image");

  if (!(source instanceof File)) {
    return json({ error: "Image file is required." }, 400);
  }

  if (!SUPPORTED_TYPES.has(source.type)) {
    return json(
      { error: "Unsupported image type. Use PNG, JPEG, WebP or AVIF." },
      415,
    );
  }

  const authHeader = createAuthHeader(apiKey);
  const sourceBuffer = await source.arrayBuffer();

  const shrinkResponse = await shrinkImage(sourceBuffer, authHeader);

  if (!shrinkResponse.ok) {
    return tinifyError(shrinkResponse);
  }

  const outputUrl = shrinkResponse.headers.get("location");

  if (!outputUrl) {
    return json({ error: "TinyPNG did not return an output URL." }, 502);
  }

  const convertResponse = await convertToWebp(outputUrl, authHeader);

  if (!convertResponse.ok) {
    return tinifyError(convertResponse);
  }

  const webpBuffer = await convertResponse.arrayBuffer();
  const finalShrinkResponse = await shrinkImage(webpBuffer, authHeader);

  if (!finalShrinkResponse.ok) {
    return tinifyError(finalShrinkResponse);
  }

  const finalOutputUrl = finalShrinkResponse.headers.get("location");

  if (!finalOutputUrl) {
    return json({ error: "TinyPNG did not return a final output URL." }, 502);
  }

  const finalResponse = await fetch(finalOutputUrl, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!finalResponse.ok) {
    return tinifyError(finalResponse);
  }

  const optimizedBuffer = await finalResponse.arrayBuffer();
  const optimizedBase64 = arrayBufferToBase64(optimizedBuffer);
  const compressionCount =
    finalResponse.headers.get("compression-count") ??
    finalShrinkResponse.headers.get("compression-count") ??
    convertResponse.headers.get("compression-count") ??
    shrinkResponse.headers.get("compression-count");

  return json({
    fileName: toWebpName(source.name),
    mimeType: "image/webp",
    originalSize: source.size,
    optimizedSize: optimizedBuffer.byteLength,
    width:
      finalResponse.headers.get("image-width") ??
      convertResponse.headers.get("image-width"),
    height:
      finalResponse.headers.get("image-height") ??
      convertResponse.headers.get("image-height"),
    compressionCount,
    data: optimizedBase64,
  });
};

function shrinkImage(image: ArrayBuffer, authHeader: string) {
  return fetch(TINIFY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/octet-stream",
    },
    body: image,
  });
}

function convertToWebp(outputUrl: string, authHeader: string) {
  return fetch(outputUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      convert: {
        type: "image/webp",
      },
    }),
  });
}

function createAuthHeader(apiKey: string) {
  return `Basic ${btoa(`api:${apiKey}`)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function tinifyError(response: Response) {
  let details: TinifyError = {};

  try {
    details = (await response.json()) as TinifyError;
  } catch {
    details = {};
  }

  return json(
    {
      error:
        details.message ??
        details.error ??
        `TinyPNG request failed with status ${response.status}.`,
    },
    response.status,
  );
}

function toWebpName(fileName: string) {
  return `${fileName.replace(/\.[^/.]+$/, "") || "optimized"}.webp`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
