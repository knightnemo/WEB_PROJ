package APIs.CommentAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class CommentInfo(
                        id: String,
                        userId: String,
                        content: String,
                        rating: Int,
                        createdAt: String,  // 已经是 String 类型，无需修改
                        upvotes: Int,
                        downvotes: Int
                      )

object CommentInfo {
  implicit val decoder: Decoder[CommentInfo] = deriveDecoder[CommentInfo]
  implicit val encoder: Encoder[CommentInfo] = deriveEncoder[CommentInfo]
}