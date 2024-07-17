package APIs.CommentAPI

case class AddCommentMessage(
                              courseId: String,
                              userId: String,
                              content: String,
                              rating: Int
                            ) extends CommentMessage[String]