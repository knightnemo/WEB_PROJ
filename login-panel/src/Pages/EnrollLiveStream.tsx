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
    capacity: number;
}

const EnrollLiveStream: React.FC = () => {
    const { username } = useUser();
    const history = useHistory();
    const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
    const [error, setError] = useState<string>('');

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

    const updateLiveStreamCapacity = async (liveStreamId: string, slotNumber: number, userName: string): Promise<boolean> => {
        try {
            const message = new UpdateLiveStreamCapacityMessage(liveStreamId, slotNumber, userName);
            const response = await axios.post(message.getURL(), { message });
            return response.data === "Live stream capacity updated successfully";
        } catch (error) {
            console.error('更新直播容量失败:', error);
            return false;
        }
    };

    const handleEnroll = async (liveStream: LiveStream) => {
        setError('');
        try {
            if (liveStream.capacity <= 0) {
                setError('该课程已满员');
                return;
            }

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

            const updated = await updateLiveStreamCapacity(liveStream.id, liveStream.slot, username);
            if (!updated) {
                setError('更新课程容量失败');
                return;
            }

            // 更新本地状态，减少课程容量
            setLiveStreams(prevStreams =>
                prevStreams.map(stream =>
                    stream.id === liveStream.id
                        ? { ...stream, capacity: stream.capacity - 1 }
                        : stream
                )
            );

            alert('报名成功');
        } catch (error) {
            console.error('报名直播课程时出错:', error);
            setError('报名直播课程失败');
        }
    };

    const handleBack = () => {
        history.goBack();
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
                        <p>剩余容量: {liveStream.capacity}</p>
                        <button
                            onClick={() => handleEnroll(liveStream)}
                            disabled={liveStream.capacity <= 0}
                        >
                            {liveStream.capacity > 0 ? '报名' : '已满员'}
                        </button>
                    </li>
                ))}
            </ul>
            <button onClick={handleBack} className="back-button">返回</button>
        </div>
    );
};

export default EnrollLiveStream;