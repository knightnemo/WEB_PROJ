package APIs.CommentAPI

case class VoteCommentMessage(
                               commentId: String,
                               userId: String,
                               voteType: String // "upvote" or "downvote"
                             ) extends CommentMessage[Boolean]