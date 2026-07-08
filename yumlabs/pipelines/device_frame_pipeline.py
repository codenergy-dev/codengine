import os
from PIL import Image, ImageDraw, ImageOps

def device_frame_pipeline(
    image,
    paste_screenshot=True,
    output_dir="output",
    # --- Body Configuration (Chassis) ---
    padding=40,                # Bezel thickness
    border_radius=60,          # Device external corner radius
    body_color="#1c1c1e",      # Device color (Dark gray/Black)
    
    # --- Screen Configuration ---
    screen_radius=40,          # Screen corner radius (internal)
    
    # --- Notch / Dynamic Island Configuration ---
    has_notch=True,
    notch_width=250,
    notch_height=70,
    notch_radius=35,
    notch_type="island",       # "island" (floating) or "connected" (attached to top)
    
    # --- Camera / Speaker Configuration ---
    has_speaker=True,
    speaker_width=100,
    speaker_height=6,
    
    # --- Button Configuration (List of dictionaries) ---
    # side: 'left' or 'right'
    buttons=[
        {"side": "left", "y": 150, "h": 60, "w": 6},   # Mute switch
        {"side": "left", "y": 250, "h": 120, "w": 6},  # Volume Up
        {"side": "left", "y": 400, "h": 120, "w": 6},  # Volume Down
        {"side": "right", "y": 280, "h": 180, "w": 6}, # Power Button
    ],
    
    # --- Home Bar (Bottom indicator) ---
    has_home_bar=True,
    home_bar_color="#ffffff",

    # --- Status Bar ---
    status_bar_height=0
):
    """
    Wraps a screenshot in a highly customizable device frame.
    """
    
    # 1. Load original image (Screenshot)
    try:
        img = Image.open(image).convert("RGBA")
        img = img.crop((0, status_bar_height, img.size[0], img.size[1]))
    except FileNotFoundError:
        print(f"Error: File {image} not found.")
        return

    w, h = img.size

    # 2. Calculate final canvas dimensions
    # Total size is image + padding on each side + space for buttons
    button_protrusion = max([b['w'] for b in buttons]) if buttons else 0
    total_w = w + (padding * 2) + (button_protrusion * 2)
    total_h = h + (padding * 2)
    
    # Create transparent base image
    base = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)

    # Main body coordinates (horizontally centered to allow space for buttons)
    body_x1 = button_protrusion
    body_y1 = 0
    body_x2 = total_w - button_protrusion
    body_y2 = total_h

    # 3. Draw Buttons (Drawn BEFORE the body to sit "behind" or integrated)
    for btn in buttons:
        btn_w = btn['w']
        btn_h = btn['h']
        btn_y = btn['y'] + padding # Adjustment relative to device top
        
        if btn['side'] == 'left':
            # Button on the left
            bx1 = body_x1 - (btn_w // 2) 
            bx2 = body_x1 + (btn_w // 2)
        else:
            # Button on the right
            bx1 = body_x2 - (btn_w // 2)
            bx2 = body_x2 + (btn_w // 2)
            
        # Draw the button with the same color as the body
        draw.rounded_rectangle(
            (bx1, btn_y, bx2, btn_y + btn_h),
            radius=3,
            fill=body_color
        )

    # 4. Draw Device Body
    draw.rounded_rectangle(
        (body_x1, body_y1, body_x2, body_y2),
        radius=border_radius,
        fill=body_color
    )

    # Exact coordinates where the screen starts
    screen_x = body_x1 + padding
    screen_y = body_y1 + padding

    if paste_screenshot:
        # 5. Prepare and Paste Screenshot (Screen)
        # We need to round the corners of the original screenshot
        mask = Image.new("L", (w, h), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle((0, 0, w, h), radius=screen_radius, fill=255)
        
        # Apply mask to original image
        img_rounded = img.copy()
        img_rounded.putalpha(mask)
        
        # Paste image in the center of the body
        base.alpha_composite(img_rounded, (screen_x, screen_y))
    else:
        # 5.1. Blank Screen (Placeholder)
        
        # Instead of creating an image and pasting, we draw directly on the base.
        # It's faster and provides the same visual result.
        draw.rounded_rectangle(
            (screen_x, screen_y, screen_x + w, screen_y + h),
            radius=screen_radius,
            fill="#ffffff"  # Empty screen color (White)
        )

    # 6. Draw Details (Notch, Camera, Speaker, Home Bar)
    
    # -- Notch / Dynamic Island --
    if has_notch:
        notch_x1 = (total_w - notch_width) // 2
        
        if notch_type == "connected":
            notch_y1 = padding
            notch_y2 = padding + notch_height
            # Draw rounded rectangle only at the bottom or full
            draw.rounded_rectangle(
                (notch_x1, notch_y1 - 20, notch_x1 + notch_width, notch_y2), 
                radius=notch_radius, 
                fill="#000000"
            )
        else: # "island" (floating)
            notch_y1 = padding + 15 # A bit below the top of the screen
            notch_y2 = notch_y1 + notch_height
            draw.rounded_rectangle(
                (notch_x1, notch_y1, notch_x1 + notch_width, notch_y2),
                radius=notch_radius,
                fill="#000000"
            )
            
            # Lens reflection (extra detail for island realism)
            cam_lens_r = notch_height // 3
            cam_x = notch_x1 + notch_width - (notch_width // 4)
            cam_y = notch_y1 + (notch_height // 2)
            draw.ellipse(
                (cam_x - cam_lens_r, cam_y - cam_lens_r, cam_x + cam_lens_r, cam_y + cam_lens_r),
                fill="#1a1a1a"
            )

    # -- Speaker Grill (above notch or on border) --
    if has_speaker:
        spk_x1 = (total_w - speaker_width) // 2
        # Position in the middle of the top border
        spk_y1 = (padding // 2) - (speaker_height // 2)
        draw.rounded_rectangle(
            (spk_x1, spk_y1, spk_x1 + speaker_width, spk_y1 + speaker_height),
            radius=2,
            fill="#2d2d2d"
        )

    # -- Home Bar (Gesture indicator at bottom of screen) --
    if has_home_bar:
        bar_w = w // 3
        bar_h = 5
        bar_x = (total_w - bar_w) // 2
        # Position a bit above the bottom edge of the screen
        bar_y = (body_y2 - padding) - 20 
        
        # Draw with transparency (requires creating new layer for alpha)
        overlay = Image.new("RGBA", base.size, (0,0,0,0))
        d_overlay = ImageDraw.Draw(overlay)
        d_overlay.rounded_rectangle(
            (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h),
            radius=50,
            fill=home_bar_color # Usually white or light gray
        )
        base = Image.alpha_composite(base, overlay)

    # 7. Save or Return
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "device_frame.png")
    base.save(output_path)

    return {"image": output_path}

# ==========================================
# USAGE EXAMPLES
# ==========================================

# Example 1: iPhone 14/15 Pro Style (Dynamic Island)
# device_frame_pipeline("my_screenshot.png", output_dir="iphone_style")

# Example 2: Generic Android Style (Small Hole Punch, less rounded corners)
# device_frame_pipeline(
#     "my_screenshot.png", 
#     output_dir="android_style",
#     padding=20,
#     border_radius=30,
#     screen_radius=20,
#     notch_type="island",
#     notch_width=40,     # Just a small hole
#     notch_height=40,
#     notch_radius=20,
#     has_home_bar=False, # Androids usually have virtual buttons or nothing
#     buttons=[ # Buttons only on the right
#         {"side": "right", "y": 200, "h": 100, "w": 4},
#         {"side": "right", "y": 350, "h": 60, "w": 4} 
#     ]
# )