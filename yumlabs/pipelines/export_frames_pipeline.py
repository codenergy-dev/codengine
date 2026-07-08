import shutil
import cv2
import os

def export_frames_pipeline(
  video: str,
  fps: int = 1,
  start: int = "00:00:00",
  end: int = None,
  output_dir: str = 'frames',
  **kwargs,
):
  if os.path.exists(output_dir):
    shutil.rmtree(output_dir)
  os.makedirs(output_dir)

  cap = cv2.VideoCapture(video)
  if not cap.isOpened():
    print("Erro ao abrir o vídeo.")
    return

  original_fps = cap.get(cv2.CAP_PROP_FPS)
  total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
  duration = total_frames / original_fps

  # Converte tempos para segundos
  start_sec = parse_time_to_seconds(start)
  end_sec = parse_time_to_seconds(end) if end else duration

  if end_sec > duration:
    end_sec = duration

  start_frame = int(start_sec * original_fps)
  end_frame = int(end_sec * original_fps)

  cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

  frame_interval = int(original_fps / fps)
  frame_count = start_frame
  exported_count = 0
  output=[]

  while frame_count < end_frame:
    ret, frame = cap.read()
    if not ret:
      break

    if (frame_count - start_frame) % frame_interval == 0:
      frame_filename = os.path.join(output_dir, f"frame_{exported_count:05d}.jpg")
      cv2.imwrite(frame_filename, frame)
      exported_count += 1
      output.append({ "image": frame_filename })

    frame_count += 1

  cap.release()
  print(f"{exported_count} frames exportados de {start} a {end or 'end'} para {output_dir}.")
  return output

def parse_time_to_seconds(time_str):
  h, m, s = map(int, time_str.split(":"))
  return h * 3600 + m * 60 + s