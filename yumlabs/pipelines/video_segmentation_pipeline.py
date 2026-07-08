import os
from ben2 import BEN_Base
import torch

def video_segmentation_pipeline(
  video: str,
  fps: int = 0,
  batch: int = 1,
  output_dir: str = 'output',
  venv: str = 'ben2',
  **kwargs,
):
  device = torch.device("cpu")
  model = BEN_Base.from_pretrained("PramaLLC/BEN2")
  model.to(device).eval()
  
  model.segment_video(
    video_path= video,
    output_path=output_dir, # Outputs will be saved as foreground.webm or foreground.mp4. The default value is "./"
    fps=fps, # If this is set to 0 CV2 will detect the fps in the original video. The default value is 0.
    refine_foreground=False,  #refine foreground is an extract postprocessing step that increases inference time but can improve matting edges. The default value is False.
    batch=batch,  # We recommended that batch size not exceed 3 for consumer GPUs as there are minimal inference gains. The default value is 1.
    print_frames_processed=True,  #Informs you what frame is being processed. The default value is True.
    webm = False, # This will output an alpha layer video but this defaults to mp4 when webm is false. The default value is False.
    rgb_value= (255, 255, 255) # If you do not use webm this will be the RGB value of the resulting background only when webm is False. The default value is a green background (0,255,0).
  )
  return { "video": os.path.join(output_dir, "foreground.mp4") }