import { CommentMessage } from 'Plugins/CommentAPI/CommentMessage'

export class VoteCommentMessage extends CommentMessage {
    commentId: string;
    userId: string;
    voteType: 'upvote' | 'downvote';

    constructor(commentId: string, userId: string, voteType: 'upvote' | 'downvote') {
        super();
        this.commentId = commentId;
        this.userId = userId;
        this.voteType = voteType;
    }

    toJSON() {
        return {
            commentId: this.commentId,
            userId: this.userId,
            voteType: this.voteType
        };
    }
}