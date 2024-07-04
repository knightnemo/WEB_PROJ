///简介界面
///created by knightnemo
///2024.7.4

import React from 'react';
import { useHistory } from 'react-router-dom';
import './AnotherPage.css';

export function AnotherPage() {
    const history = useHistory();

    return (
        <div className="another-page">
            <header className="page-header">
                <h1>医疗系统简介</h1>
            </header>
            <main className="page-content">
                <section className="intro-card">
                    <h2>系统概述</h2>
                    <p>
                        欢迎使用我们的先进医疗系统。本系统旨在revolutionize医疗保健行业，
                        通过尖端技术提供高效、精准的医疗服务。
                    </p>
                </section>
                <section className="intro-card">
                    <h2>主要功能</h2>
                    <ul>
                        <li>医生和患者账户管理</li>
                        <li>患者信息的安全存储和访问</li>
                        <li>实时医患沟通平台</li>
                        <li>智能诊断辅助系统</li>
                        <li>医疗记录的电子化管理</li>
                    </ul>
                </section>
                <section className="intro-card">
                    <h2>技术特点</h2>
                    <p>
                        采用最新的加密技术保护患者隐私，运用人工智能算法辅助诊断，
                        并通过区块链技术确保医疗记录的不可篡改性。
                    </p>
                </section>
            </main>
            <button className="return-button" onClick={() => history.push('/')}>
                返回主页
            </button>
        </div>
    );
}