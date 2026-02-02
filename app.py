from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import os
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import threading

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
# Configuration
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

def cleanup_old_files():
    """Remove files older than 1 hour"""
    cutoff = datetime.now() - timedelta(hours=1)
    for folder in [UPLOAD_FOLDER, RESULTS_FOLDER]:
        for filename in os.listdir(folder):
            filepath = os.path.join(folder, filename)
            if os.path.getmtime(filepath) < cutoff.timestamp():
                os.remove(filepath)
def validate_image(file_path):
    """Verify file is a valid image"""
    try:
        img = cv2.imread(file_path)
        if img is None:
            return False
        return True
    except:
        return False
# Schedule periodic cleanup
def schedule_cleanup():
    cleanup_old_files()
    threading.Timer(3600, schedule_cleanup).start()  # Every hour

schedule_cleanup()
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def compare_and_save_diff(img1_path, img2_path, diff_save_path):
    """
    Compare two images optimized for 480x800 resolution, save a visual diff image.
    Returns the path and comparison statistics.
    """
    img1 = cv2.imread(img1_path)
    img2 = cv2.imread(img2_path)

    if img1 is None or img2 is None:
        raise FileNotFoundError(f"One of the images not found: {img1_path}, {img2_path}")

    target_width, target_height = 480, 800
    img1 = cv2.resize(img1, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
    img2 = cv2.resize(img2, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)

    diff = cv2.absdiff(img1, img2)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (3, 3), 0)

    _, thresh_coarse = cv2.threshold(gray_blur, 20, 255, cv2.THRESH_BINARY)
    _, thresh_fine = cv2.threshold(gray_blur, 35, 255, cv2.THRESH_BINARY)
    combined_thresh = cv2.bitwise_or(thresh_coarse, thresh_fine)

    kernel = np.ones((2, 2), np.uint8)
    combined_thresh = cv2.morphologyEx(combined_thresh, cv2.MORPH_CLOSE, kernel)
    combined_thresh = cv2.morphologyEx(combined_thresh, cv2.MORPH_OPEN, kernel)

    total_pixels = target_width * target_height
    diff_pixels = np.sum(combined_thresh > 0)
    similarity_percentage = ((total_pixels - diff_pixels) / total_pixels) * 100

    result_img = img2.copy()
    mask = combined_thresh > 0
    red_overlay = np.zeros_like(result_img)
    red_overlay[mask] = [0, 0, 255]
    result_img = cv2.addWeighted(result_img, 0.7, red_overlay, 0.3, 0)

    contours, _ = cv2.findContours(combined_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(result_img, contours, -1, (0, 0, 255), 2)
    result_img = cv2.convertScaleAbs(result_img, alpha=1.1, beta=10)
    cv2.imwrite(diff_save_path, result_img, [cv2.IMWRITE_PNG_COMPRESSION, 1])

    return {
        'diff_path': diff_save_path,
        'similarity_percentage': round(similarity_percentage, 2),
        'total_pixels': total_pixels,
        'different_pixels': int(diff_pixels),
        'image_dimensions': f"{target_width}x{target_height}",
        'difference_ratio': round((diff_pixels / total_pixels) * 100, 3)
    }

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Image comparison service is running'})

@app.route('/api/compare', methods=['POST'])
def compare_images():
    try:
        print("compare image request received")
        if 'original' not in request.files or 'current' not in request.files:
            return jsonify({'error': 'Both original and current images are required'}), 400

        original_file = request.files['original']
        current_file = request.files['current']

        if original_file.filename == '' or current_file.filename == '':
            return jsonify({'error': 'No files selected'}), 400

        if not (allowed_file(original_file.filename) and allowed_file(current_file.filename)):
            return jsonify({'error': 'Invalid file type. Allowed: png, jpg, jpeg, gif, bmp, tiff'}), 400

        session_id = str(uuid.uuid4())
        original_filename = f"{session_id}_original_{secure_filename(original_file.filename)}"
        current_filename = f"{session_id}_current_{secure_filename(current_file.filename)}"

        original_path = os.path.join(app.config['UPLOAD_FOLDER'], original_filename)
        current_path = os.path.join(app.config['UPLOAD_FOLDER'], current_filename)

        original_file.save(original_path)
        current_file.save(current_path)

        diff_filename = f"{session_id}_diff.png"
        diff_path = os.path.join(app.config['RESULTS_FOLDER'], diff_filename)

        result = compare_and_save_diff(original_path, current_path, diff_path)

        return jsonify({
            'success': True,
            'session_id': session_id,
            'similarity_percentage': result['similarity_percentage'],
            'total_pixels': result['total_pixels'],
            'different_pixels': result['different_pixels'],
            'image_dimensions': result['image_dimensions'],
            'difference_ratio': result['difference_ratio'],
            'diff_filename': diff_filename,
            'timestamp': datetime.now().isoformat(),
            'processing_info': {
                'optimized_for': '480x800 resolution',
                'algorithm': 'Enhanced multi-threshold detection',
                'quality': 'High-definition output'
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        # Validate filename
        filename = secure_filename(filename)
        if not filename or '..' in filename:
            return jsonify({'error': 'Invalid filename'}), 400

        file_path = os.path.join(app.config['RESULTS_FOLDER'], filename)
        # Ensure the resolved path is within RESULTS_FOLDER
        if not os.path.abspath(file_path).startswith(os.path.abspath(app.config['RESULTS_FOLDER'])):
            return jsonify({'error': 'Invalid file path'}), 400

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, as_attachment=True, download_name=f"comparison_{filename}")
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/preview/<filename>', methods=['GET'])
def preview_file(filename):
    try:
        file_path = os.path.join(app.config['RESULTS_FOLDER'], filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
