package APIs.LiveStreamAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class LiveStreamInfo(
                           id: String,
                           name: String,
                           classroom: String,
                           teacher: String,
                           slot: Int
                         )

object LiveStreamInfo {
  implicit val decoder: Decoder[LiveStreamInfo] = deriveDecoder[LiveStreamInfo]
  implicit val encoder: Encoder[LiveStreamInfo] = deriveEncoder[LiveStreamInfo]
}