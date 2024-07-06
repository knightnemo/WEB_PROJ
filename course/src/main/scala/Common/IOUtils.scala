package Common

import cats.effect.IO
import io.circe.{Decoder, DecodingFailure, Encoder, Json, JsonObject}
import org.joda.time.DateTime
import org.joda.time.format.ISODateTimeFormat

object IOUtils {
  def addTypeField(json: Json, typeName: String): Json =
    json.asObject match {
      case Some(jsonObject) => // If the json can be converted to a JsonObject
        Json.fromJsonObject(jsonObject.add("type", Json.fromString(typeName)))
      case None => 
        json 
    }
  def raiseError(st:String): IO[String]=
    throw new Exception(st)
    
  def assertIO(assertion: Boolean, message: String): IO[Unit] =
    if !assertion then throw Exception(message)
    else IO.unit

  given encodeDateTime: Encoder[DateTime] = Encoder.instance { dateTime =>
    Json.fromLong(dateTime.getMillis)
  }

  given decodeDateTime: Decoder[DateTime] = Decoder.instance { cursor =>
    cursor.as[Long].map(new DateTime(_))
  }
}
