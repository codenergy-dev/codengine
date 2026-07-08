import cv2
import mediapipe as mp
import numpy as np
from scipy.spatial.distance import cosine

mp_pose = mp.solutions.pose

def video_pose_detection_pipeline(
  video_path: str,
  pose_threshold: float = 0.05,
  pose_min_frames: int = 15,
  output_dir: str = "output",
  **kwargs,
):
  cap = cv2.VideoCapture(video_path)
  pose = mp_pose.Pose(static_image_mode=False, model_complexity=1)
  
  unique_poses = []
  unique_frames = []
  buffer_pose = None
  buffer_count = 0
  
  frame_id = 0
  while True:
    ret, frame = cap.read()
    if not ret:
      break
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = pose.process(frame_rgb)
    
    if results.pose_landmarks:
      pose_vec = extract_pose_vector(results.pose_landmarks)
      
      if buffer_pose is None:
        buffer_pose = pose_vec
        buffer_count = 1
        buffer_frame = frame.copy()
      else:
        dist = cosine(buffer_pose, pose_vec)
        if dist < pose_threshold:
          buffer_pose = pose_vec
          buffer_count += 1
        else:
          if buffer_count >= pose_min_frames:
            unique_poses.append(buffer_pose)
            unique_frames.append(buffer_frame)
          
          buffer_pose = pose_vec
          buffer_count = 1
          buffer_frame = frame.copy()
    
    frame_id += 1
  
  if buffer_count >= pose_min_frames:
    unique_poses.append(buffer_pose)
    unique_frames.append(buffer_frame)
  
  cap.release()
  pose.close()
  
  output = []
  for i, frame in enumerate(unique_frames):
    path = f"{output_dir}/video_pose_{i}.jpg"
    cv2.imwrite(path, frame)
    output.append({ "image": path })
  
  return output

def extract_pose_vector(landmarks):
  coords = []
  for lm in landmarks.landmark:
    coords.append([lm.x, lm.y])
  coords = np.array(coords).flatten()
  coords = coords - np.mean(coords)
  return coords