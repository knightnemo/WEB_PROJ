import { CommentMessage } from './CommentMessage'

export class LikeCommentMessage extends CommentMessage {
    commentId: string;

    constructor(commentId: string) {
        super();
        this.commentId = commentId;
    }
}