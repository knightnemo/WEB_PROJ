import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage'

export class DeleteCommentMessage extends CommentMessage {
    commentId: string;

    constructor(commentId: string) {
        super();
        this.commentId = commentId;
    }

    toJSON() {
        return {
            commentId: this.commentId
        };
    }
}