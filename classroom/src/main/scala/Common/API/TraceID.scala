package Common.API

import io.circe.*
import io.circe.generic.semiauto.*


case class TraceID(id:String):
  override def toString: String = id

object TraceID {
  implicit val encodeTraceID: Encoder[TraceID] = Encoder.encodeString.contramap[TraceID](_.toString)
  implicit val decodeTraceID: Decoder[TraceID] = Decoder.decodeString.emap { str =>Right(TraceID(str))}
}