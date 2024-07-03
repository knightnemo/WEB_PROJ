package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName


case class PatientQueryMessagePlanner(doctorName:String, patientName:String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    /** 故意写入数据库一个消息，注意到，如果中间出现rollback，这个消息是写不进去的。 */
    startTransaction{
      writeDB(s"INSERT INTO ${schemaName}.doctor_rec (doctor_name, patient_name) VALUES (?, ?)",
        List(SqlParameter("String", doctorName),
          SqlParameter("String", patientName)
        ))
//        rollback()  //这句可以注释了看看效果
    }>>
    IO.pure(patientName)
  }
