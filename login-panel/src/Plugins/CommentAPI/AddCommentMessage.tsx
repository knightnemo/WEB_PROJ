import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage';
import axios from 'axios';

export class AddCommentMessage extends CommentMessage {
    courseId: string;
    userId: string;
    content: string;
    parentId?: string;

    constructor(courseId: string, userId: string, content: string, parentId?: string) {
        super();
        this.courseId = courseId;
        this.userId = userId;
        this.content = content;
        this.parentId = parentId;
    }

    getURL() {
        return '/api/comment/add';
    }

    toJSON() {
        return {
            courseId: this.courseId,
            userId: this.userId,
            content: this.content,
            parentId: this.parentId || null // 确保 parentId 为 null 时也包括在 JSON 中
        };
    }

    async send() {
        const response = await axios.post(this.getURL(), this.toJSON(), {
            headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
    }
}
