chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "convertImage") {
    convertAndDownload(request.src, request.format, request.filename);
  }
});

async function convertAndDownload(src, format, filename) {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const dataUrl = await blobToDataURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
      canvas.toBlob(
        (blob) => {
          const url = URL.createObjectURL(blob);
          chrome.runtime.sendMessage({
            action: "download",
            dataUrl: url,
            filename: filename,
          });
        },
        mimeType,
        1.0
      );
    };

    img.onerror = () => {
      chrome.runtime.sendMessage({
        action: "download",
        dataUrl: src,
        filename: filename,
      });
    };

    img.src = dataUrl;
  } catch (error) {
    console.error("Error converting image:", error);
    chrome.runtime.sendMessage({
      action: "download",
      dataUrl: src,
      filename: filename,
    });
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}
