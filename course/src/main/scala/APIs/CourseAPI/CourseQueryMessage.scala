package APIs.CourseAPI

import io.circe.{Decoder, Encoder}

case class CourseQueryMessage(searchTerm: String) extends CourseMessage[List[Course]]

object CourseQueryMessage {
  // Import Course decoder and encoder
  import Course._

  // Decoder for List[Course] is automatically derived by circe
  implicit val coursesDecoder: Decoder[List[Course]] = Decoder.decodeList[Course]

  // Encoder for List[Course] is automatically derived by circe
  implicit val coursesEncoder: Encoder[List[Course]] = Encoder.encodeList[Course]
}