import React from 'react';
import axios, { isAxiosError } from 'axios';
import { API } from 'Plugins/CommonUtils/API';
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage';
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage';
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage';
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage';
import { AddPatientMessage } from 'Plugins/DoctorAPI/AddPatientMessage';
import { DeletePatientMessage } from 'Plugins/DoctorAPI/DeletePatientMessage';
import { ViewPatientMessage } from 'Plugins/DoctorAPI/ViewPatientMessage';
import { useHistory } from 'react-router';
import './Main.css';

export function Main() {
    const history = useHistory();

    const sendPostRequest = async (message: API) => {
        // ... (保持不变)
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>医疗系统控制中心</h1>
            </header>
            <main className="app-main">
                <section className="card doctor-section">
                    <h2>医生操作</h2>
                    <button onClick={() => sendPostRequest(new LoginMessage('aaaa', 'bbbb'))}>
                        医生登录 (aaaa)
                    </button>
                    <button onClick={() => sendPostRequest(new RegisterMessage('aaaa', 'bbbb'))}>
                        医生注册 (aaaa)
                    </button>
                    <button onClick={() => sendPostRequest(new LoginMessage('aaaab', 'bbbb'))}>
                        医生登录 (aaaab)
                    </button>
                </section>
                <section className="card patient-section">
                    <h2>患者操作</h2>
                    <button onClick={() => sendPostRequest(new PatientLoginMessage('cccc', 'bbbb'))}>
                        患者登录 (cccc)
                    </button>
                    <button onClick={() => sendPostRequest(new PatientRegisterMessage('cccc', 'bbbb'))}>
                        患者注册 (cccc)
                    </button>
                </section>
                <section className="card management-section">
                    <h2>患者管理</h2>
                    <button onClick={() => sendPostRequest(new AddPatientMessage('aaaa', 'cccc'))}>
                        添加患者
                    </button>
                    <button onClick={() => sendPostRequest(new DeletePatientMessage('cccc', 'bbbb'))}>
                        删除患者
                    </button>
                    <button onClick={() => sendPostRequest(new ViewPatientMessage('cccc','bbbb'))}>
                        查看患者列表
                    </button>
                </section>
                <button className="intro-button" onClick={() => history.push("/AnotherPage")}>
                    系统简介
                </button>
            </main>
        </div>
    );
}