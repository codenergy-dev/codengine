import cv2
import mediapipe as mp
import numpy as np
import os
from controlnet_aux import AnylineDetector, CannyDetector, HEDdetector, OpenposeDetector, SamDetector, ContentShuffleDetector, ZoeDetector
# from easy_dwpose import DWposeDetector
from PIL import Image, ImageDraw
import torch

def controlnet_pipeline(
  image: str,
  preprocessor: str = "canny",
  output_dir: str = "output",
  **kwargs,
):
  device = "cuda" if torch.cuda.is_available() else "cpu"
  
  image_file = Image.open(image).convert("RGB")
  pipe: list[str] = []

  if 'anyline' in preprocessor:
    output = os.path.join(output_dir, "anyline.png")
    anyline = AnylineDetector.from_pretrained("TheMistoAI/MistoLine", filename="MTEED.pth", subfolder="Anyline").to(device)
    anyline(image_file).save(output)
    pipe.append(output)
  
  if 'canny' in preprocessor:
    output = os.path.join(output_dir, "canny.png")
    canny = CannyDetector()
    canny(image_file).save(output)
    pipe.append(output)
  
  if 'hed' in preprocessor:
    output = os.path.join(output_dir, "hed.png")
    hed = HEDdetector.from_pretrained("lllyasviel/Annotators").to(device)
    hed(image_file).save(output)
    pipe.append(output)
  
  # if 'pose' in preprocessor:
  #   output = os.path.join(output_dir, "pose.png")
  #   pose = OpenposeDetector.from_pretrained("lllyasviel/ControlNet")
  #   pose(image_file).save(output)
  #   pipe.append(output)
  
  # dwpose
  # if 'pose' in preprocessor:
  #   output = os.path.join(output_dir, "pose.png")
  #   dwpose = DWposeDetector()
  #   dwpose(image_file, output_type="pil", include_hands=True, include_face=True).save(output)
  #   pipe.append(output)
  
  # mediapipe
  if 'pose' in preprocessor:
    output = os.path.join(output_dir, "pose.png")
    mediapipe_pose(image, output)
    pipe.append(output)
  
  if 'seg' in preprocessor:
    output = os.path.join(output_dir, "seg.png")
    seg = SamDetector.from_pretrained("ybelkada/segment-anything", subfolder="checkpoints")
    seg(image_file).save(output)
    pipe.append(output)
  
  if 'shuffle' in preprocessor:
    output = os.path.join(output_dir, "shuffle.png")
    shuffle = ContentShuffleDetector()
    shuffle(image_file).save(output)
    pipe.append(output)
  
  if 'zoe' in preprocessor:
    output = os.path.join(output_dir, "zoe.png")
    zoe = ZoeDetector.from_pretrained("lllyasviel/Annotators").to(device)
    zoe(image_file).save(output)
    pipe.append(output)
  
  for output in pipe:
    resize = Image.open(output).resize(image_file.size, resample=Image.LANCZOS)
    resize.save(output)
  
  return { "controlnet": [output for output in pipe] }

def mediapipe_pose(image_path, output_path):
  """
  Detects pose using MediaPipe, converts to COCO format, and draws the skeleton
  on a black canvas using the specific OpenPose COCO 18 colors from the reference chart.

  Args:
      image_path (str): Path to the input image file.
      output_path (str): Path to save the output skeleton image.
  """
  # --- Initialize MediaPipe Pose ---
  mp_pose = mp.solutions.pose
  pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
  mp_drawing = mp.solutions.drawing_utils # Not used for drawing here, but part of the ecosystem

  # --- Load image ---
  image = cv2.imread(image_path)
  if image is None:
      print(f"Error: Could not load image from {image_path}")
      return
  height, width = image.shape[:2]

  # --- Process image with MediaPipe Pose ---
  image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
  results = pose.process(image_rgb)

  # --- Create black canvas ---
  canvas = np.zeros((height, width, 3), dtype=np.uint8)

  # --- MediaPipe to COCO 18 Keypoint Mapping ---
  # Maps MediaPipe landmark index to COCO 18 index
  mp_to_coco = {
      0: 0,  # Nose
      # 1: Neck (Calculated)
      12: 2, # Right Shoulder
      14: 3, # Right Elbow
      16: 4, # Right Wrist
      11: 5, # Left Shoulder
      13: 6, # Left Elbow
      15: 7, # Left Wrist
      24: 8, # Right Hip
      26: 9, # Right Knee
      28: 10,# Right Ankle
      23: 11,# Left Hip
      25: 12,# Left Knee
      27: 13,# Left Ankle
      5: 14, # Right Eye
      2: 15, # Left Eye
      8: 16, # Right Ear
      7: 17  # Left Ear
  }

  # --- COCO 18 Colors (Extracted from the reference chart, converted to BGR) ---

  # Joint Colors (index: BGR)
  joint_colors = {
      0:  (0,   0,   255), # Nose       (Red)
      1:  (0,  85,   255), # Neck       (Orange)
      2:  (0, 170,   255), # R Shoulder (Light Orange)
      3:  (0, 255,   255), # R Elbow    (Yellow)
      4:  (0, 255,   170), # R Wrist    (Light Green)
      5:  (0, 255,    85), # L Shoulder (Green)
      6:  (0, 255,     0), # L Elbow    (Strong Green)
      7:  (85, 255,    0), # L Wrist    (Green-Cyan)
      8:  (170, 255,   0), # R Hip      (Cyan-Green)
      9:  (255, 255,   0), # R Knee     (Cyan)
      10: (255, 170,   0), # R Ankle    (Light Blue)
      11: (255,  85,   0), # L Hip      (Blue)
      12: (255,   0,   0), # L Knee     (Strong Blue)
      13: (255,   0,  85), # L Ankle    (Blue-Magenta)
      14: (255,   0, 170), # R Eye      (Magenta)
      15: (255,   0, 255), # L Eye      (Strong Magenta)
      16: (170,   0, 255), # R Ear      (Magenta-Red)
      17: (85,  0,   255)  # L Ear      (Red-Magenta)
  }

  # Bone Connections and Colors ((joint_a, joint_b): BGR)
  # Using the "60% color" column from the chart, converted to BGR
  bone_colors = {
      (1, 2):  (0,   0, 153), # Neck -> R Shoulder (Dark Red)
      (1, 5):  (0,  51, 153), # Neck -> L Shoulder (Dark Orange)
      (2, 3):  (0, 102, 153), # R Shoulder -> R Elbow
      (3, 4):  (0, 153, 153), # R Elbow -> R Wrist (Dark Yellow)
      (5, 6):  (0, 153, 102), # L Shoulder -> L Elbow
      (6, 7):  (0, 153,  51), # L Elbow -> L Wrist (Dark Green)
      (1, 8):  (0, 153,   0), # Neck -> R Hip (Medium Green)
      (8, 9):  (51, 153,  0), # R Hip -> R Knee
      (9, 10): (102, 153, 0), # R Knee -> R Ankle (Dark Cyan-Green)
      (1, 11): (153, 153, 0), # Neck -> L Hip (Dark Cyan)
      (11, 12):(153, 102, 0), # L Hip -> L Knee
      (12, 13):(153, 51,  0), # L Knee -> L Ankle (Dark Blue)
      (1, 0):  (153, 0,   0), # Neck -> Nose (Medium Blue)
      (0, 14): (153, 0,  51), # Nose -> R Eye
      (14, 16):(153, 0, 102), # R Eye -> R Ear
      (0, 15): (153, 0, 153), # Nose -> L Eye (Medium Magenta)
      (15, 17):(102, 0, 153), # L Eye -> L Ear
      # Optional: Add Hip-to-Hip and Shoulder-to-Shoulder if desired
      # (8, 11): (128, 128, 128), # R Hip -> L Hip (Example: Grey)
      # (2, 5):  (128, 128, 128), # R Shoulder -> L Shoulder (Example: Grey)
  }

  # --- Collect detected COCO points ---
  coco_points = {}
  if results.pose_landmarks:
      landmarks = results.pose_landmarks.landmark
      for mp_idx, coco_idx in mp_to_coco.items():
          if mp_idx < len(landmarks):
              lm = landmarks[mp_idx]
              # Use visibility threshold if needed, e.g., lm.visibility > 0.5
              if lm.visibility > 0.1: # Lower threshold to get more points
                  x, y = int(lm.x * width), int(lm.y * height)
                  coco_points[coco_idx] = (x, y)

      # --- Calculate Neck (COCO 1) as midpoint of shoulders (COCO 2 and 5) ---
      if 2 in coco_points and 5 in coco_points:
          r_shoulder = np.array(coco_points[2])
          l_shoulder = np.array(coco_points[5])
          neck_coord = tuple(((r_shoulder + l_shoulder) / 2).astype(int))
          coco_points[1] = neck_coord

  # --- Draw Connections (Bones) ---
  for (idx_a, idx_b), color in bone_colors.items():
      if idx_a in coco_points and idx_b in coco_points:
          pt1 = coco_points[idx_a]
          pt2 = coco_points[idx_b]
          cv2.line(canvas, pt1, pt2, color=color, thickness=2, lineType=cv2.LINE_AA)

  # --- Draw Joints (Circles) ---
  joint_radius = 3 # Adjust radius as needed
  for coco_idx, pt in coco_points.items():
      color = joint_colors.get(coco_idx, (255, 255, 255)) # Default to white if index not in map
      cv2.circle(canvas, pt, radius=joint_radius, color=color, thickness=-1, lineType=cv2.LINE_AA)

  # --- Save image ---
  cv2.imwrite(output_path, canvas)
  print(f"Skeleton image saved to {output_path}")

  # --- Clean up ---
  pose.close()