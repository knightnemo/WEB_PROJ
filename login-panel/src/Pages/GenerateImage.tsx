import * as React from 'react';
import { useState } from 'react';
import { TextField, Button } from '@material-ui/core';
import { RequestRedirect } from 'node-fetch';
import './GenerateImage.css';
import { useParams, useHistory, Link } from 'react-router-dom';

const SD_API_KEY ='';

const GenerateImage = () => {
    const [prompt, setPrompt] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [error, setError] = useState('');
    const history = useHistory();

    const handleGenerateImage = async () => {
        setError('');
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
            "key": SD_API_KEY,
            "prompt": prompt,
            "negative_prompt": "bad quality",
            "width": "512",
            "height": "512",
            "safety_checker": false,
            "seed": null,
            "samples": 1,
            "base64": false,
            "webhook": null,
            "track_id": null
        });

        const requestOptions: RequestInit = {
            method: 'POST',
            headers: myHeaders,
            body: raw,
            redirect: 'follow' as RequestRedirect
        };

        try {
            const response = await fetch("https://modelslab.com/api/v6/realtime/text2img", requestOptions);
            const result = await response.json();
            if (result.status === "success" && result.output && result.output.length > 0) {
                setImageUrl(result.output[0]);
            } else {
                setError('生成图片失败，请重试');
                console.log('API返回的完整结果:', result);
            }
        } catch (error) {
            setError('发生错误，请重试');
            console.log('错误', error);
        }
    };

    return (
        <div className="generate-image-container">
            <button onClick={() => history.push('/')} className="back-button">
                返回主页
            </button>
            <h1 className="generate-image-title">生成图像</h1>
            <div className="generate-image-form">
                <TextField
                    label="描述你想要的图像"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    fullWidth
                    variant="outlined"
                    placeholder="例如：一个未来科技城市的夜景"
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleGenerateImage}
                    className="generate-button"
                >
                    生成图像
                </Button>
            </div>
            {error && <p className="error-message">{error}</p>}
            {imageUrl && <img src={imageUrl} alt="生成的图像" className="generated-image" />}
            <p className="powered-by">Powered by StableDiffusion</p>
        </div>
    );
};

export default GenerateImage;