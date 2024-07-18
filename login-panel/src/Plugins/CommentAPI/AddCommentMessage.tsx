import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage'
import { v4 as uuidv4 } from 'uuid';

export class AddCommentMessage extends CommentMessage {
    id: string;
    courseId: string;
    userId: string;
    content: string;
    rating: number;

    constructor(
        courseId: string,
        userId: string,
        content: string,
        rating: number
    ) {
        super();
        this.id = uuidv4();
        this.courseId = courseId;
        this.userId = userId;
        this.content = content;
        this.rating = rating;
    }

    toJSON() {
        return {
            id: this.id,
            courseId: this.courseId,
            userId: this.userId,
            content: this.content,
            rating: this.rating
        };
    }
}