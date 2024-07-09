import React, { useState, useCallback, useRef } from 'react';
import './ImageUploader.css';

interface ImageUploaderProps {
    onImageSelect: (file: File | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
    const [dragActive, setDragActive] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileSize, setFileSize] = useState<number | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files[0]);
        }
    };

    const handleFiles = (file: File) => {
        setFileName(file.name);
        setFileSize(file.size);
        onImageSelect(file);

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleReset = () => {
        setFileName(null);
        setFileSize(null);
        setPreviewUrl(null);
        onImageSelect(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="dropzone-box">
            <h2>上传课程封面图片</h2>
            <p>将图片拖放到此处或点击上传</p>
            <div
                className={`dropzone-area ${dragActive ? 'dropzone--over' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="preview-image" />
                ) : (
                    <>
                        <div className="file-upload-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2"
                                 stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                            </svg>
                        </div>
                        <p>点击上传或拖放图片到这里</p>
                    </>
                )}
                <input
                    type="file"
                    id="upload-file"
                    name="uploaded-file"
                    onChange={handleChange}
                    accept="image/*"
                    ref={fileInputRef}
                />
                <p className="message">
                    {fileName ? `${fileName}, ${fileSize} bytes` : '未选择文件'}
                </p>
            </div>
            <div className="dropzone-actions">
                <button type="button" onClick={handleReset}>
                    取消
                </button>
            </div>
        </div>
    );
};