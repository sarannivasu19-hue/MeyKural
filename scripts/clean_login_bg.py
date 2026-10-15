"""
clean_login_bg.py
Removes baked-in text from upper-right region of client/public/images/login-bg.png
using row-wise interpolation from surrounding sky pixels + feathered blending.
Exports clean WebP files at 1920, 1080, and 768 px widths.
"""
import os
import cv2
import numpy as np
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
IMG_DIR = os.path.join(PROJECT_DIR, 'client', 'public', 'images')
SRC_PATH = os.path.join(IMG_DIR, 'login-bg.png')

def clean_and_export():
    if not os.path.exists(SRC_PATH):
        raise FileNotFoundError(f"Source image not found: {SRC_PATH}")

    img_bgr = cv2.imread(SRC_PATH)
    h, w = img_bgr.shape[:2]
    print(f"Original image size: {w}x{h}")

    x1, x2 = int(w * 0.52), int(w * 0.85)
    y1, y2 = int(h * 0.11), int(h * 0.49)

    # For each row y in [y1, y2], linearly interpolate between pixel at x1-2 and pixel at x2+2
    clean_patch = np.zeros((y2 - y1, x2 - x1, 3), dtype=np.float32)

    for row_idx, y in enumerate(range(y1, y2)):
        left_color = img_bgr[y, x1 - 2].astype(np.float32)
        right_color = img_bgr[y, x2 + 2].astype(np.float32)
        
        alphas = np.linspace(0, 1, x2 - x1).reshape(1, -1, 1)
        interp_row = (1 - alphas) * left_color + alphas * right_color
        clean_patch[row_idx] = interp_row[0]

    clean_patch_blurred = cv2.GaussianBlur(clean_patch, (21, 21), 0)

    # Smoothly blend the patch edges using feathering mask
    mask = np.zeros((y2 - y1, x2 - x1), dtype=np.float32)
    feather = 15
    for i in range(y2 - y1):
        for j in range(x2 - x1):
            dist_y = min(i, (y2 - y1 - 1) - i)
            dist_x = min(j, (x2 - x1 - 1) - j)
            alpha_y = min(1.0, dist_y / feather)
            alpha_x = min(1.0, dist_x / feather)
            mask[i, j] = alpha_y * alpha_x

    mask_3d = mask[:, :, np.newaxis]
    orig_roi = img_bgr[y1:y2, x1:x2].astype(np.float32)
    blended_roi = orig_roi * (1 - mask_3d) + clean_patch_blurred * mask_3d

    img_bgr[y1:y2, x1:x2] = np.clip(blended_roi, 0, 255).astype(np.uint8)

    # Save full clean PNG & WebP
    out_png = os.path.join(IMG_DIR, 'login-bg-clean.png')
    cv2.imwrite(out_png, img_bgr)

    pil_img = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    clean_webp = os.path.join(IMG_DIR, 'login-bg-clean.webp')
    pil_img.save(clean_webp, 'WEBP', quality=92)
    print(f"Saved: {clean_webp} ({pil_img.width}x{pil_img.height})")

    # Responsive export at widths: 1920, 1080, 768
    widths = [1920, 1080, 768]
    for target_w in widths:
        target_h = int(h * (target_w / w))
        resized = pil_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        out_path = os.path.join(IMG_DIR, f'login-bg-clean-{target_w}.webp')
        resized.save(out_path, 'WEBP', quality=90)
        print(f"Saved responsive WebP: login-bg-clean-{target_w}.webp ({target_w}x{target_h})")

    print("[SUCCESS] Inpainting and responsive WebP generation completed successfully!")

if __name__ == '__main__':
    clean_and_export()
