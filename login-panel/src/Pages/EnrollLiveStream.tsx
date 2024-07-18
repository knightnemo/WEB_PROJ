import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import { GetAllLiveStreamsMessage } from 'Plugins/LiveStreamAPI/GetAllLiveStreamsMessage';
import { CheckPatientSlotAvailabilityMessage } from 'Plugins/PatientAPI/CheckPatientSlotAvailabilityMessage';
import { OccupyPatientSlotMessage } from 'Plugins/PatientAPI/OccupyPatientSlotMessage';
import { UpdateLiveStreamCapacityMessage } from 'Plugins/LiveStreamAPI/UpdateLiveStreamCapacityMessage';
import './EnrollLiveStream.css';
import { useHistory } from 'react-router-dom';

interface LiveStream {
    id: string;
    name: string;
    classroom: string;
    teacher: string;
    slot: number;
}

const EnrollLiveStream: React.FC = () => {
    const { username } = useUser();
    const history = useHistory();
    const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
    const [error, setError] = useState<string>('');

    const handleBack = () => {
        history.goBack();
    };
    useEffect(() => {
        fetchLiveStreams();
    }, []);

    const fetchLiveStreams = async () => {
        try {
            const message = new GetAllLiveStreamsMessage();
            const response = await axios.post(message.getURL(), { message });
            setLiveStreams(response.data);
        } catch (error) {
            console.error('获取直播课程列表失败:', error);
            setError('获取直播课程列表失败');
        }
    };

    const checkSlotAvailability = async (slotNumber: number): Promise<boolean> => {
        try {
            const message = new CheckPatientSlotAvailabilityMessage(username, slotNumber);
            const response = await axios.post(message.getURL(), { message });
            return response.data;
        } catch (error) {
            console.error('检查时段可用性时出错:', error);
            return false;
        }
    };

    const occupyPatientSlot = async (slotNumber: number, courseName: string): Promise<boolean> => {
        try {
            const message = new OccupyPatientSlotMessage(username, slotNumber, courseName);
            await axios.post(message.getURL(), { message });
            return true;
        } catch (error) {
            console.error('占用时段失败:', error);
            return false;
        }
    };

    const handleEnroll = async (liveStream: LiveStream) => {
        setError('');
        try {
            const isAvailable = await checkSlotAvailability(liveStream.slot);
            if (!isAvailable) {
                setError('您已经在该时段报名了其他课程');
                return;
            }

            const occupied = await occupyPatientSlot(liveStream.slot, liveStream.name);
            if (!occupied) {
                setError('占用时段失败');
                return;
            }

            alert('报名成功');
            fetchLiveStreams();
        } catch (error) {
            console.error('报名直播课程时出错:', error);
            setError('报名直播课程失败');
        }
    };

    return (
        <div className="enroll-live-stream">
            <h2>可用直播课程</h2>
            {error && <p className="error">{error}</p>}
            <ul className="live-stream-list">
                {liveStreams.map((liveStream) => (
                    <li key={liveStream.id} className="live-stream-item">
                        <h3>{liveStream.name}</h3>
                        <p>教师: {liveStream.teacher}</p>
                        <p>教室: {liveStream.classroom}</p>
                        <p>时段: {liveStream.slot}</p>
                        <button onClick={() => handleEnroll(liveStream)}>
                            报名
                        </button>
                        <button onClick={handleBack} className="back-button">返回</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default EnrollLiveStream;