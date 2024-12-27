function getSuggestedFilename(src, type) {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return `image_${Date.now()}.${type}`;
  }

  let filename = src
    .replace(/[?#].*/, "")
    .split("/")
    .pop()
    .replace(/\+/g, " ");

  filename = decodeURIComponent(filename);
  filename = filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  filename = filename.substring(0, 32).trim();

  return `${filename || "image"}.${type}`;
}

async function fetchAsDataURL(src) {
  if (src.startsWith("data:")) return src;

  try {
    const response = await fetch(src);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}

function downloadImage(dataUrl, filename) {
  chrome.downloads.download(
    {
      url: dataUrl,
      filename: filename,
      saveAs: true,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError);
      }
    }
  );
}

async function convertImage(dataUrl, type, filename) {
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const mimeType = type === "jpg" ? "image/jpeg" : `image/${type}`;
      canvas.toBlob(
        (blob) => {
          resolve(URL.createObjectURL(blob));
        },
        mimeType,
        1.0
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ["JPG", "PNG", "WebP"].forEach((type) => {
    chrome.contextMenus.create({
      id: `save-as-${type.toLowerCase()}`,
      title: `Save as ${type}`,
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.srcUrl) return;

  const format = info.menuItemId.split("-")[2];
  const filename = getSuggestedFilename(info.srcUrl, format);

  try {
    const dataUrl = await fetchAsDataURL(info.srcUrl);

    if (dataUrl.includes(`image/${format.toLowerCase()}`)) {
      downloadImage(dataUrl, filename);
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: convertImage,
        args: [dataUrl, format, filename],
      },
      (results) => {
        if (results && results[0] && results[0].result) {
          downloadImage(results[0].result, filename);
          setTimeout(() => URL.revokeObjectURL(results[0].result), 60000);
        }
      }
    );
  } catch (error) {
    console.error("Error processing image:", error);
    downloadImage(info.srcUrl, filename);
  }
});
