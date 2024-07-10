package APIs.CommentAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class Comment(
                    id: String,
                    courseId: String,
                    userId: String,
                    content: String,
                    likes: String,
                    dislikes: String,
                    createdAt: String,
                    parentId: Option[String],  // 父评论的ID，顶级评论为None
                    replies: List[Comment] = List.empty  // 子评论列表
                  )

object Comment {
  implicit val commentDecoder: Decoder[Comment] = deriveDecoder[Comment]
  implicit val commentEncoder: Encoder[Comment] = deriveEncoder[Comment]
}