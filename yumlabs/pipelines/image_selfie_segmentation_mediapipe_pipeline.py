import cv2
import mediapipe as mp
import numpy as np

mp_selfie = mp.solutions.selfie_segmentation
mp_pose = mp.solutions.pose

def image_selfie_segmentation_mediapipe_pipeline(
  image: str,
  with_segmentation_mask: bool = True,
  with_pose_mask: bool = False,
  output_dir: str = 'output',
  **kwargs,
):
  image_bgr = cv2.imread(image)
  
  h, w, _ = image_bgr.shape
  image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

  if with_segmentation_mask:
    with mp_selfie.SelfieSegmentation(model_selection=1) as selfie:
      segmentation_mask = selfie.process(image_rgb).segmentation_mask
      mask_seg = (segmentation_mask > 0.6).astype(np.uint8) * 255

  if with_pose_mask:
    with mp_pose.Pose(static_image_mode=True, model_complexity=1) as pose:
      pose_landmarks = pose.process(image_rgb).pose_landmarks
      if pose_landmarks:
        mask_pose = np.zeros((h, w), dtype=np.uint8)

        points = []
        for lm in pose_landmarks.landmark:
          x, y = int(lm.x * w), int(lm.y * h)
          points.append((x, y))
          cv2.circle(mask_pose, (x, y), 20, 255, -1)

        connections = mp_pose.POSE_CONNECTIONS
        for c in connections:
          p1 = points[c[0]]
          p2 = points[c[1]]
          cv2.line(mask_pose, p1, p2, 255, 40)

  if with_segmentation_mask and with_pose_mask:
    mask_bin = cv2.bitwise_or(mask_seg, mask_pose)
  elif with_segmentation_mask:
    mask_bin = mask_seg
  elif with_pose_mask:
    mask_bin = mask_pose
  else:
    raise Exception("At least with_segmentation_mask or with_pose_mask must be True.")

  mask_bin = cv2.GaussianBlur(mask_bin, (15,15), 0)
  alpha = mask_bin.astype(np.float32) / 255.0

  output = np.zeros((h, w, 4), dtype=np.uint8)
  output[..., :3] = image_bgr
  output[..., 3] = (alpha * 255).astype(np.uint8)

  output_path = f"{output_dir}/image_selfie_segmentation_mediapipe_pipeline.png"
  cv2.imwrite(output_path, output)
  
  return { "image": output_path }
