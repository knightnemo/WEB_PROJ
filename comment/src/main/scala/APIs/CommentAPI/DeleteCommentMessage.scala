package APIs.CommentAPI

case class DeleteCommentMessage(commentId: String) extends CommentMessage[Boolean]