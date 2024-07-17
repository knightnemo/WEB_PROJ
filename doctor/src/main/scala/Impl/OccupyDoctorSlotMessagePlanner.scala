package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.OccupyDoctorSlotMessage

case class OccupyDoctorSlotMessagePlanner(message: OccupyDoctorSlotMessage, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    val OccupyDoctorSlotMessage(doctorName, slotNumber, courseName) = message

    val checkSlotAvailable = readDBBoolean(
      s"SELECT slot$slotNumber = '0' FROM ${schemaName}.doctors WHERE user_name = ?",
      List(SqlParameter("String", doctorName))
    )

    checkSlotAvailable.flatMap { isAvailable =>
      if (isAvailable) {
        writeDB(
          s"UPDATE ${schemaName}.doctors SET slot$slotNumber = ? WHERE user_name = ?",
          List(SqlParameter("String", courseName), SqlParameter("String", doctorName))
        ).map(_ => s"Slot $slotNumber for doctor $doctorName has been occupied with course $courseName")
      } else {
        IO.raiseError(new Exception(s"Slot $slotNumber for doctor $doctorName is already occupied"))
      }
    }
  }