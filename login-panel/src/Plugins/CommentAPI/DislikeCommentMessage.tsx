import { CommentMessage } from './CommentMessage'

export class DislikeCommentMessage extends CommentMessage {
    commentId: string;

    constructor(commentId: string) {
        super();
        this.commentId = commentId;
    }
}