# Yumlabs

**Easily automate Python code using visual pipelines defined in yUML.**

![Yumlabs diagram example](example/example.svg)

Yumlabs is a growing collection of modular pipelines built using [Pypeyuml](https://github.com/codenergy-dev/pypeyuml), enabling you to automate complex Python workflows visually with [yUML](https://yuml.me/).

## ✨ Features

- 🧩 Plug-and-play pipeline modules for common automation tasks
- 🖼️ Image processing and generation workflows ready to use
- 🧠 Easy integration with AI tools like Stable Diffusion and ControlNet
- 💡 Custom pipeline support with minimal Python code
- 🔄 Supports multiple virtual environments for each pipeline — avoid dependency conflicts with full flexibility
- 📊 Visual representation of workflows using `.yuml` files

## 🔧 How It Works

1. Define your workflow steps using a `.yuml` following the [class diagram syntax](https://github.com/jaime-olivares/yuml-diagram/wiki#class-diagram).
2. Each block corresponds to a Python function stored in a `pipelines/*_pipeline.py` file.
3. Run the workflow via Pypeyuml, and it handles the execution chain automatically.

## 📦 Getting Started

```sh
git clone https://github.com/codenergy-dev/yumlabs.git

cd yumlabs

git clone https://github.com/codenergy-dev/pypeyuml.git

# Required for most pipelines
python3 -m venv venv
./venv/bin/pip install -r requirements/venv.txt

# Required for image_segmentation_pipeline and video_segmentation_pipeline
python3 -m venv ben2
./ben2/bin/pip install -r requirements/ben2.txt

# Required for image_restoration_pipeline
python3 -m venv realesrgan
./realesrgan/bin/pip install -r requirements/realesrgan.txt

# First create a yUML workflow
source ./venv/bin/activate
python3 ./pypeyuml/main.py ./yuml/resize_image.yuml ./pipelines
```

## 📁 Structure

```
yumlabs/
├── example/
│   └── example.yuml
├── pipelines/
│   ├── raw_image_pipeline.py
│   ├── resize_pipeline.py
│   └── ...
├── pypeyuml/
│   ├── main.py
│   └── ...
├── run_pipeline.py
└── README.md
```

## 🧪 Powered by

- [Pypeyuml](https://github.com/codenergy-dev/pypeyuml)
- [Python 3.10.16](https://www.python.org/downloads/)
- [yUML](https://yuml.me/)