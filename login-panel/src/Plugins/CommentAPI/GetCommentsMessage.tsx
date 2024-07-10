import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage'

export class GetCommentsMessage extends CommentMessage {
    courseId: string;

    constructor(courseId: string) {
        super();
        this.courseId = courseId;
    }
}