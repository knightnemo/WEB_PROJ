package APIs.LiveStreamAPI

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto._

case class LiveStreamInfo(
                           id: String,
                           name: String,
                           capacity: Int,
                           slot1: String,
                           slot2: String,
                           slot3: String,
                           slot4: String,
                           slot5: String,
                           slot6: String,
                           slot7: String,
                           slot8: String
                         )

object LiveStreamInfo {
  implicit val decoder: Decoder[LiveStreamInfo] = deriveDecoder[LiveStreamInfo]
  implicit val encoder: Encoder[LiveStreamInfo] = deriveEncoder[LiveStreamInfo]
}